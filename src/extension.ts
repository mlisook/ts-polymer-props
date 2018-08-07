'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as ts from 'typescript';
import * as elex from './elementXref';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    let ptp = new PolymerTsProps();

    let disposable_updateTsProps = vscode.commands.registerCommand('extension.updateTsProps', () => { ptp.updateTsProps(); });
    let disposable_updatePolymerProps = vscode.commands.registerCommand('extension.updatePolymerProps', () => { ptp.updatePolymerProps(); });
    let disposable_updateElementAccessor = vscode.commands.registerCommand('extension.updateElementAccessor', () => { ptp.updateElementAccessor(); });

    context.subscriptions.push(disposable_updateTsProps);
    context.subscriptions.push(disposable_updatePolymerProps);
    context.subscriptions.push(disposable_updateElementAccessor);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

/**
 * Describes the position in the active
 * editor window where a property declaration is located.
 */
interface IpropPosition {
    start: number;
    end: number;
    editorPosition?: vscode.Range;
    jsDoc?: string;
}

/**
 * Describes a jsDoc comment on a property
 */
export interface IjsdocComment {
    sourceComment: string;
    typeTag: string;
    typeValue: string;
    polyPropTag: string;
    polyPropValue: string;
    targetComment: string;
}


export interface IpolyProp {
    [index: string]: string;
    value: string;
    reflectToAttribute: string;
    readOnly: string;
    notify: string;
    computed: string;
    observer: string;
}

/**
 * structure for building change list
 * in the target property declarations
 */
export interface IpropBuild {
    [index: string]: any;
    name: string;
    polymerType: string;
    tsType: string;
    typeComment: string;
    value: string;
    reflectToAttribute: string;
    readOnly: string;
    notify: string;
    computed: string;
    observer: string;
    polymerDeclareStyleObject: boolean;
    jsDoc: IjsdocComment | null;
    isNew: boolean;
    existingTargetDeclaration: IpropPosition;
    sourceDeclaration: IpropPosition;
}

export class PolymerTsProps {

    /** 
     * line ending character(s) used in the editor
     */
    lineEnding: string;
    /**
     * length of line ending character(s) used in the editor
     */
    lineEndingLength: number;
    /**
     * size of tab stops used in the editor
     */
    tabSize: number;
    /**
     * string value of one tab stop (e.g. '\t' or '  ')
     */
    tabValue: string;
    /**
     * regular expression to get the contents 
     * of the @polyProp JsDoc expression
     */
    rxPolyPropValue: RegExp;

    constructor() {
        this.lineEnding = <string>vscode.workspace.getConfiguration("files", null).get("eol");
        this.lineEndingLength = this.lineEnding.length;
        this.tabSize = <number>vscode.workspace.getConfiguration("editor", null).get("tabSize");
        const insertSpaces: boolean = <boolean>vscode.workspace.getConfiguration("editor", null).get("insertSpaces");
        this.tabValue = "\t";
        if (insertSpaces && this.tabSize > 0) {
            this.tabValue = " ".repeat(this.tabSize);
        }
        this.rxPolyPropValue = /{(.+)}/;
    }

    /**
     * reads the static get properties() { ... } declaration
     * and generates typescript class level properties
     */
    public updateTsProps(): void {
        let editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage(`There is no open editor.`);
            return; // No open text editor
        }
        if (!editor.document.fileName.endsWith('.ts')) {
            vscode.window.showInformationMessage(`Not a typescript document.`);
            return;
        }

        let ast = this._getWindowAst(editor);

        const ppn = this._getPolymerPropsNode(ast);
        if (!ppn) {
            vscode.window.showInformationMessage(`polymer property node not found.`);
            return;
        }
        const pprops = this._getPolymerProperties(ppn);
        const tsProps = this._getTsAllProps(ast);
        let bld = this._buildPolyToTsList(pprops, tsProps);
        const insertionPoint = this._getTsPropStart(bld, ppn);
        let newProps: string = this._generateTsPropDecs(bld);
        this._performDocumentUpdates(editor, bld, newProps, insertionPoint);
        vscode.window.showInformationMessage(`${bld.length} Polymer properties added/updated as TS properties.`);
    }

    /**
     * reads typescript class level property declarations and
     * generates the polymer static get properties() { ... } code block
     */
    public updatePolymerProps(): void {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage(`There is no open editor.`);
            return; // No open text editor
        }
        if (!editor.document.fileName.endsWith('.ts')) {
            vscode.window.showInformationMessage(`Not a typescript document.`);
            return;
        }

        let ast = this._getWindowAst(editor);
        if (ast) {
            const ppn = this._getPolymerPropsNode(ast);
            if (!ppn) {
                vscode.window.showInformationMessage(`polymer static get properties() node not found.`);
                return;
            }
            const tsprops: ts.Node[] = this._getTsPolyProps(ast);
            const pprops = this._getPolymerProperties(ppn);
            let bld = this._buildTsToPolyist(tsprops, pprops, editor.document.getText());
            bld = bld.concat(this._buildTsToPolyistUnmatched(bld, pprops, editor.document.getText()));
            const insertionPoint = this._getPolymerPropStart(bld, ppn);
            let newProps: string = this._generatePolymerPropDecs(bld);
            this._performDocumentUpdates(editor, bld, newProps, insertionPoint);
            vscode.window.showInformationMessage(`${bld.length} TS properties added/updated as Polymer properties.`);
        }
    }

    /**
     * Inserts or updates the polymer $ convenience property
     * that allows easy access to the elements in the template
     * which have an ID
     */
    updateElementAccessor(): void {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage(`There is no open editor.`);
            return; // No open text editor
        }
        if (!editor.document.fileName.endsWith('.ts')) {
            vscode.window.showInformationMessage(`Not a typescript document.`);
            return;
        }

        const ast = this._getWindowAst(editor);
        const cls = <ts.ClassDeclaration | null>this._getClassNode(ast);
        if (!cls) {
            return;
        }
        if (ast) {
            let elemList = this._buildElementList(ast);
            if (elemList.length === 0) {
                vscode.window.showInformationMessage(`Could not find any template elements with an id.`);
                return;
            }
            // find the name of the class to form the interface name
            const clsIdNode = this._walkUntil(cls, ts.SyntaxKind.Identifier, '');
            const interfaceName: string = clsIdNode ? 'I$' + clsIdNode.getText() : 'I$';
            // find the interface if it's already present
            const existingIntfDec = this._walkUntil(ast, ts.SyntaxKind.InterfaceDeclaration, interfaceName);
            // find the existing property declaration if it's already present
            const existingProperty = this._walkUntil(cls, ts.SyntaxKind.PropertyDeclaration, '$!:');
            // if there is no existing property, we need to know where
            // to insert the new property, so get the template getter
            const templateGetter = this._walkUntil(cls, ts.SyntaxKind.GetAccessor, 'static get template');
            if (!existingProperty && !templateGetter) {
                return;
            }
            // insertion points
            const piPoint: IpropPosition = existingProperty ? { start: existingProperty.pos, end: existingProperty.end } :
                templateGetter ? { start: templateGetter.end, end: templateGetter.end } : { start: 0, end: 0 };
            piPoint.editorPosition = this._getVscodeRange(editor, piPoint.start, piPoint.end);
            const iiPoint: IpropPosition = existingIntfDec ? { start: existingIntfDec.pos, end: existingIntfDec.end } :
                { start: cls.pos, end: cls.pos };
            iiPoint.editorPosition = this._getVscodeRange(editor, iiPoint.start, iiPoint.end);
            // form the interface declaration
            const intfDecString: string = this.lineEnding + "interface " + interfaceName + " {" +
                elemList.reduce((pval: string, nextVal: elex.InamedElements) => {
                    return pval + this.lineEnding + this.tabValue + nextVal.id + ': ' + nextVal.className + ';';
                }, "") + this.lineEnding + '}';
            // form the property dec string
            const propDecString: string = this.lineEnding + this.tabValue + '$!: ' + interfaceName + ';';
            // perform updates
            editor.edit((editBuilder) => {
                if (piPoint.editorPosition) {
                    if (piPoint.start !== piPoint.end) {
                        editBuilder.replace(piPoint.editorPosition, propDecString);
                    } else {
                        editBuilder.insert(piPoint.editorPosition.start, propDecString);
                    }
                }
                if (iiPoint.editorPosition){
                    if (iiPoint.start !== iiPoint.end){
                        editBuilder.replace(iiPoint.editorPosition, intfDecString);
                    } else {
                        editBuilder.insert(iiPoint.editorPosition.start, intfDecString);
                    }
                }
            });
            vscode.window.showInformationMessage(`Updated the $ property with ${elemList.length} elements.`);
        }
    }

    /**
     * Gets a list of IDs used in the element template
     * @param ast abstract syntax tree
     */
    _buildElementList(ast: ts.SourceFile): elex.InamedElements[] {
        const cn = this._getClassNode(ast);
        if (!cn) {
            vscode.window.showInformationMessage(`class declaration not found.`);
            return [];
        }
        const tmplNode = this._walkUntil(cn, ts.SyntaxKind.GetAccessor, 'static get template()');
        if (!tmplNode) { return []; }
        const tmplExprNode = this._walkUntil(tmplNode, ts.SyntaxKind.TaggedTemplateExpression, "html");
        if (!tmplExprNode) { return []; }
        const tmpl = tmplExprNode.getText();
        return elex.parseTemplateForIds(tmpl);
    }

    /**
     * Returns an array of properties to be built
     * out of the polymer properties declarations
     * @param polymerProps array of property declarations from static get properties() { ... }
     * @param tsProps array of typescript class level declarations
     */
    _buildPolyToTsList(polymerProps: ts.Node[], tsProps: ts.Node[]): IpropBuild[] {
        let result: IpropBuild[] = [];
        polymerProps.forEach((pp) => {
            const ppid = pp.getText().split(':')[0].trim();
            const tsp = tsProps.find((p) => {
                const id = this._walkUntil(p, ts.SyntaxKind.Identifier, "");
                if (!id) {
                    return false;
                } else {
                    return id.getText() === ppid;
                }
            });
            let ppbld: IpropBuild = {
                name: ppid,
                polymerType: this._parsePolymerDecType(pp),
                tsType: "",
                typeComment: this._parsePolymerDecAnnotatedType(pp),
                value: this._parsePolymerDecTerm(pp, 'value'),
                reflectToAttribute: this._parsePolymerDecTerm(pp, 'reflectToAttribute'),
                readOnly: this._parsePolymerDecTerm(pp, 'readOnly'),
                notify: this._parsePolymerDecTerm(pp, 'notify'),
                computed: this._parsePolymerDecTerm(pp, 'computed'),
                observer: this._parsePolymerDecTerm(pp, 'observer'),
                polymerDeclareStyleObject: false,
                jsDoc: this._getJsDoc(pp),
                isNew: true,
                existingTargetDeclaration: { start: -1, end: -1 },
                sourceDeclaration: { start: pp.pos, end: pp.end }
            };
            if (ppbld.value || ppbld.reflectToAttribute || ppbld.readOnly || ppbld.notify || ppbld.computed || ppbld.observer) {
                ppbld.polymerDeclareStyleObject = true;
            }
            if (ppbld.jsDoc && ppbld.jsDoc.typeTag) {
                this._removeJsDocLine(ppbld.jsDoc, ppbld.jsDoc.typeTag);
            }
            if (ppbld.jsDoc && ppbld.jsDoc.targetComment) {
                this._insertIntoJsDoc(ppbld.jsDoc, this._generatePolyPropComment(ppbld), 1);
                ppbld.jsDoc.targetComment = this._formatJsDoc(ppbld.jsDoc.targetComment, 1);
            }
            if (tsp) {
                ppbld.isNew = false;
                ppbld.existingTargetDeclaration = { start: tsp.pos, end: tsp.end };
            }
            ppbld.tsType = ppbld.typeComment ? ppbld.typeComment : this._PolymerTypeToTs(ppbld.polymerType);
            result.push(ppbld);
        });
        return result;
    }

    /**
     * Returns an array of polymer properties to be built
     * out of the ts class properties declarations
     * @param tsProps array of typescript class level declarations
     * @param polymerProps array of property declarations from static get properties() { ... }
     */
    _buildTsToPolyist(tsProps: ts.Node[], polymerProps: ts.Node[], editorText: string): IpropBuild[] {
        let result: IpropBuild[] = [];
        tsProps.forEach((tp) => {
            const idNode = this._walkUntil(tp, ts.SyntaxKind.Identifier, '');
            const tpType = tp.getText().split(':')[1].replace(';', '').trim();
            if (idNode) {
                const tsid = idNode.getText();
                const pp = polymerProps.find((p) => {
                    return tsid === p.getText().split(':')[0].trim();
                });

                let tsbld: IpropBuild = {
                    name: tsid,
                    polymerType: this._tsTypeToPolymerType(tp),
                    tsType: tpType,
                    typeComment: ['string', 'any', 'number', 'Date', 'boolean'].indexOf(tpType) >= 0 ? "" : tpType,
                    value: '',
                    reflectToAttribute: '',
                    readOnly: '',
                    notify: '',
                    computed: '',
                    observer: '',
                    polymerDeclareStyleObject: false,
                    jsDoc: this._getJsDoc(tp),
                    isNew: true,
                    existingTargetDeclaration: { start: -1, end: -1 },
                    sourceDeclaration: { start: tp.pos, end: tp.end }
                };

                if (tsbld.jsDoc) {
                    this._removeJsDocLine(tsbld.jsDoc, tsbld.jsDoc.polyPropTag);
                }
                if (tsbld.jsDoc && tsbld.typeComment) {
                    this._insertIntoJsDoc(tsbld.jsDoc, '@type {' + tsbld.typeComment + '}', 3);
                }

                if (pp) {
                    tsbld.isNew = false;
                    tsbld.existingTargetDeclaration = { start: pp.pos, end: pp.end };
                    if (editorText.substring(pp.end, pp.end + 1) === ",") {
                        tsbld.existingTargetDeclaration.end += 1;
                    }
                }
                if (!tsbld.jsDoc) {
                    const rx = /\/\/\s+@polyProp\s*({.*})/g;
                    const m = rx.exec(tp.getFullText());
                    if (m) {
                        const ppv = this._parsePolyPropDetails(m[1]);
                        ['value', 'notify', 'observer', 'readOnly', 'reflectToAttribute', 'computed'].forEach((term: string) => {
                            tsbld[term] = ppv[term];
                        });
                    }
                } else {
                    if (tsbld.jsDoc.polyPropValue) {
                        const ppv = this._parsePolyPropDetails(tsbld.jsDoc.polyPropValue);
                        ['value', 'notify', 'observer', 'readOnly', 'reflectToAttribute', 'computed'].forEach((term: string) => {
                            tsbld[term] = ppv[term];
                        });
                    }
                    tsbld.jsDoc.targetComment = this._formatJsDoc(tsbld.jsDoc.targetComment, 3);
                }
                if (tsbld.value || tsbld.reflectToAttribute || tsbld.readOnly || tsbld.notify || tsbld.computed || tsbld.observer) {
                    tsbld.polymerDeclareStyleObject = true;
                }
                result.push(tsbld);
            }
        });
        return result;
    }

    /**
     * Creates a build list of polymer properties that
     * are not contained in the typescript properties list.
     * This is used to add back in polymer properties that
     * don't have a typescript property when copying from TS
     * to polymer. 
     * @param tsp typescript to polymer property build
     * @param polymerProps array of all polymer property nodes
     * @param editorText text of the active editor windoew
     */
    _buildTsToPolyistUnmatched(tsp: IpropBuild[], polymerProps: ts.Node[], editorText: string): IpropBuild[] {
        let result: IpropBuild[] = [];
        polymerProps.forEach((pp) => {
            const ppid = pp.getText().split(':')[0].trim();
            const t = tsp.find((p) => {
                return p.name === ppid;
            });
            if (!t) {
                let ppbld: IpropBuild = {
                    name: ppid,
                    polymerType: this._parsePolymerDecType(pp),
                    tsType: "",
                    typeComment: this._parsePolymerDecAnnotatedType(pp),
                    value: this._parsePolymerDecTerm(pp, 'value'),
                    reflectToAttribute: this._parsePolymerDecTerm(pp, 'reflectToAttribute'),
                    readOnly: this._parsePolymerDecTerm(pp, 'readOnly'),
                    notify: this._parsePolymerDecTerm(pp, 'notify'),
                    computed: this._parsePolymerDecTerm(pp, 'computed'),
                    observer: this._parsePolymerDecTerm(pp, 'observer'),
                    polymerDeclareStyleObject: false,
                    jsDoc: this._getJsDoc(pp),
                    isNew: false,
                    existingTargetDeclaration: { start: pp.pos, end: pp.end },
                    sourceDeclaration: { start: pp.pos, end: pp.end }
                };
                if (ppbld.value || ppbld.reflectToAttribute || ppbld.readOnly || ppbld.notify || ppbld.computed || ppbld.observer) {
                    ppbld.polymerDeclareStyleObject = true;
                }
                if (editorText.substring(pp.end, pp.end + 1) === ",") {
                    ppbld.existingTargetDeclaration.end += 1;
                }

                result.push(ppbld);
            }
        });

        return result;
    }

    /**
     * Formats jsdoc 
     * @param src jsdoc string to format
     * @param indentLevel indentation level
     */
    _formatJsDoc(src: string, indentLevel: number): string {
        const indentStr: string = this.tabValue.repeat(indentLevel);
        // Needs further research, but jsDoc doesn't seem to have consistent
        // line ending from line to line which screws with regex
        // expressions standardizing spaces.  For now, remove all
        // \r before formatting and handle it line by line.
        const srcArray: string[] = src.replace(/\r/g, '').split('\n');
        if (srcArray.length < 3) {
            return "";
        }
        return srcArray.reduce((pval: string, nextVal: string) => {
            const nextValTrim: string = nextVal.trim();
            return pval + (nextValTrim.startsWith('/*') ? indentStr + nextValTrim : (nextValTrim.startsWith('*') ? indentStr + ' ' + nextValTrim : nextValTrim)) + this.lineEnding;
        }, "");
    }

    /**
     * generates a string with typescript class property declarations
     * sorted by property name
     * @param bld array of polymer properties 
     */
    _generatePolymerPropDecs(bld: IpropBuild[]): string {
        bld.sort((a, b) => {
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
        let resultArray: string[] = bld.map((b) => {
            let decText: string = b.jsDoc ? b.jsDoc.targetComment : (b.polymerType === 'Object' || b.polymerType === 'Array' ? this.tabValue.repeat(3) + '// @type {' + b.tsType + '}' + this.lineEnding : "");
            if (!b.polymerDeclareStyleObject) {
                decText += this.tabValue.repeat(3) + b.name + ': ' + b.polymerType;
            } else {
                decText += this.tabValue.repeat(3) + b.name + ': {' + this.lineEnding;
                let dlm = "";
                ["type", "value", "reflectToAttribute", "readOnly", "notify", "computed", "observer"].forEach((k) => {
                    const kk = k === "type" ? 'polymerType' : k;
                    if (b[kk]) {
                        decText += dlm + this.tabValue.repeat(4) + k + ': ' + b[kk];
                        dlm = "," + this.lineEnding;
                    }
                });
                decText += this.lineEnding + this.tabValue.repeat(3) + '}';
            }
            return decText;
        });
        return this.lineEnding + resultArray.join(',' + this.lineEnding);
    }

    /**
     * generates a string with typescript class property declarations
     * sorted by property name
     * @param bld array of polymer properties 
     */
    _generateTsPropDecs(bld: IpropBuild[]): string {
        // let result = this.lineEnding + this.lineEnding;
        let result: string[] = [""];
        bld.sort((a, b) => {
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
        bld.forEach((b) => {
            result.push((b.jsDoc ? b.jsDoc.targetComment : this.tabValue + '// ' + this._generatePolyPropComment(b) + this.lineEnding) +
                this.tabValue + b.name + "!: " + b.tsType + ";");
        });
        return result.join(this.lineEnding);
    }

    /**
     * generate the polyProp comment applied to a typescript property declaration
     * @param b build item
     */
    _generatePolyPropComment(b: IpropBuild): string {
        let result = "";
        if (b.polymerDeclareStyleObject) {
            result += " {";
            let delim = " ";
            ["value", "reflectToAttribute", "readOnly", "notify", "computed", "observer"].forEach((k) => {
                if (<string>b[k]) {
                    result += delim + k + ": " + b[k];
                    delim = ", ";
                }
            });
            result += " }";
        }
        return "@polyProp" + result;
    }

    /**
     * Returns the node cooresponding to the class declaration
     * @param ast Abstract Syntax Tree
     */
    _getClassNode(ast: ts.SourceFile): ts.Node | null {
        return this._walkUntil(ast, ts.SyntaxKind.ClassDeclaration, "class");
    }

    /**
     * returns a structured object with the
     * important elements of a jsdoc comment
     * @param propertyDec property declartion node
     */
    _getJsDoc(propertyDec: ts.Node): IjsdocComment | null {
        let result: IjsdocComment | null = null;
        const jd: ts.Node | null = this._walkUntil(propertyDec, ts.SyntaxKind.JSDocComment, '');
        if (jd) {
            result = {
                sourceComment: jd.getText(),
                typeTag: '',
                typeValue: '',
                polyPropTag: '',
                polyPropValue: '',
                targetComment: jd.getText()
            };
            const jdtype = this._walkUntil(jd, ts.SyntaxKind.JSDocTypeTag, '');
            if (jdtype) {
                result.typeTag = jdtype.getText();
                const atype = this._walkUntil(jdtype, ts.SyntaxKind.ArrayType, '') ? '[]' : '';
                const typeref = this._walkUntil(jdtype, ts.SyntaxKind.TypeReference, '');
                if (typeref) {
                    result.typeValue = typeref.getText() + atype;
                }
            }
            if (result.sourceComment.includes('@polyProp')) {
                const polytag: ts.JSDocTag | null = <ts.JSDocTag | null>this._walkUntil(jd, ts.SyntaxKind.JSDocTag, '@polyProp');
                if (polytag) {
                    result.polyPropValue = polytag.comment ? polytag.comment : '';
                    result.polyPropTag = polytag.getText() + (polytag.comment ? polytag.comment : '');
                }
            }
        }
        return result;
    }

    /**
     * gets an array of properties declared in the
     * static get properties() { ... } node
     * @param ppn polymer properties node
     */
    _getPolymerProperties(ppn: ts.Node): ts.Node[] {
        let result: ts.Node[] = [];
        const ppnReturnStmt = this._walkUntil(ppn, ts.SyntaxKind.ReturnStatement, "return");
        if (ppnReturnStmt) {
            const ppnReturnValue = this._walkUntil(ppnReturnStmt, ts.SyntaxKind.ObjectLiteralExpression, "{");
            if (ppnReturnValue && ppnReturnValue.getChildCount() > 0) {
                const rvSyntaxList = this._walkUntil(ppnReturnValue, ts.SyntaxKind.SyntaxList, ":");
                if (rvSyntaxList) {
                    const rvslChildren = rvSyntaxList.getChildren();
                    rvslChildren.forEach((c) => {
                        if (c.kind === ts.SyntaxKind.PropertyAssignment) {
                            result.push(c);
                        }
                    });
                }
            }
        }
        return result;
    }

    /**
     * Returns the polymer static properties node
     * @param ast AST of the active editor window
     */
    _getPolymerPropsNode(ast: ts.SourceFile): ts.Node | null {
        const cn = this._getClassNode(ast);
        if (!cn) {
            vscode.window.showInformationMessage(`class declaration not found.`);
            return null;
        }
        const propNode = this._walkUntil(cn, ts.SyntaxKind.GetAccessor, 'static get properties()');
        return propNode;
    }

    /**
     * Returns an array of all property descriptors
     * from class level declarations.
     * @param ast Abstract Syntax Tree
     */
    _getTsAllProps(ast: ts.SourceFile): ts.Node[] {
        let result: ts.Node[] = [];
        const cls = this._getClassNode(ast);
        if (cls) {
            const sl = this._walkUntil(cls, ts.SyntaxKind.SyntaxList, ':');
            if (sl) {
                const slChildren = sl.getChildren();
                if (slChildren && slChildren.length > 0) {
                    slChildren.forEach((c) => {
                        if (c.kind === ts.SyntaxKind.PropertyDeclaration) {
                            result.push(c);
                        }
                    });
                }
            }
        }
        return result;
    }

    /**
     * Returns an array of property descriptors
     * from class level property descriptors that
     * have the 'polyProp' comment.
     * @param ast Abstract Syntax Tree
     */
    _getTsPolyProps(ast: ts.SourceFile): ts.Node[] {
        let result: ts.Node[] = [];
        const cls = this._getClassNode(ast);
        if (cls) {
            const sl = this._walkUntil(cls, ts.SyntaxKind.SyntaxList, '@polyProp');
            if (sl) {
                const slChildren = sl.getChildren();
                if (slChildren && slChildren.length > 0) {
                    slChildren.forEach((c) => {
                        if (c.kind === ts.SyntaxKind.PropertyDeclaration && c.getFullText().includes('@polyProp')) {
                            result.push(c);
                        }
                    });
                }
            }
        }
        return result;
    }

    /**
     * Returns the starting point for inserting polymer properties
     * @param bld array of properties to build
     * @param ppn polymer property node
     */
    _getPolymerPropStart(bld: IpropBuild[], ppn: ts.Node): number {
        let fbld = bld.filter((p) => {
            return !p.isNew;
        });
        if (fbld.length > 0) {
            fbld.sort((a, b) => {
                return a.existingTargetDeclaration.start - b.existingTargetDeclaration.start;
            });
            return fbld[0].existingTargetDeclaration.start;
        } else {
            const rtn = this._walkUntil(ppn, ts.SyntaxKind.ReturnStatement, '');
            if (rtn) {
                const ole = this._walkUntil(rtn, ts.SyntaxKind.ObjectLiteralExpression, '{');
                if (ole) {
                    return ole.pos + ole.getFullText().indexOf('{') + 1;
                } else {
                    vscode.window.showInformationMessage(`Could not find "return {" in static get properties() block`);
                    return 0;
                }
            } else {
                vscode.window.showInformationMessage(`Could not find "return {" in static get properties() block`);
                return 0;
            }
        }
    }

    /**
     * Returns the starting point for inserting typescript properties
     * @param bld array of properties to build
     * @param ppn polymer property node
     */
    _getTsPropStart(bld: IpropBuild[], ppn: ts.Node): number {
        let fbld = bld.filter((p) => {
            return !p.isNew;
        });
        if (fbld.length > 0) {
            fbld.sort((a, b) => {
                return a.existingTargetDeclaration.start - b.existingTargetDeclaration.start;
            });
            return fbld[0].existingTargetDeclaration.start;
        } else {
            return ppn.pos;
        }
    }

    /**
     * Converts string position begin/end pair into line/col pair
     * used by VSCode to perform edits
     * @param editor active editor
     * @param stringPos starting position in the document when viewed as one long string
     * @param stringEnd ending position in the document as a string
     */
    _getVscodeRange(editor: vscode.TextEditor, stringPos: number, stringEnd: number): vscode.Range {
        let p: number = 0;
        let doc = editor.document;
        let start: vscode.Position = new vscode.Position(0, 0);
        let stop: vscode.Position = new vscode.Position(0, 0);
        let startFound = false;
        let stopFound = false;

        for (let index = 0; index < doc.lineCount; index++) {
            let lineText = doc.lineAt(index).text;
            if (!startFound && p + lineText.length + this.lineEndingLength > stringPos) {
                start = new vscode.Position(index, stringPos - p);
                startFound = true;
            }
            if (!stopFound && p + lineText.length + this.lineEndingLength > stringEnd) {
                stop = new vscode.Position(index, stringEnd - p);
                stopFound = true;
            }
            p += lineText.length + this.lineEndingLength;
        }
        if (!startFound || !stopFound) {
            vscode.window.showInformationMessage(`Property position conversion failed.`);
            return new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
        } else {
            return new vscode.Range(start, stop);
        }
    }

    /**
     * Returns the abstract syntax tree of a typescript editor window
     * @param editor Active editor
     */
    _getWindowAst(editor: vscode.TextEditor): ts.SourceFile {
        const sourceCode: string = editor.document.getText();
        let ast = ts.createSourceFile(editor.document.fileName, sourceCode, ts.ScriptTarget.Latest, true);
        return ast;
    }

    /**
     * Adds a line of text to the end of the target jsdoc comment
     * @param jsd jsdoc structure
     * @param lineText line to insert
     * @param indentLevel indent level
     */
    _insertIntoJsDoc(jsd: IjsdocComment, lineText: string, indentLevel: number): void {
        jsd.targetComment = jsd.targetComment.replace('*/', '* ' + lineText + this.lineEnding + '*/');
    }

    /**
     * Gets the type from the polymer property declaration
     * @param pp polymer property declaration node
     */
    _parsePolymerDecType(pp: ts.Node): string {
        if (pp.getText().includes('{')) {
            const pptypedec = this._walkUntil(pp, ts.SyntaxKind.PropertyAssignment, 'type:', false, true);
            if (pptypedec) {
                return pptypedec.getText().split(':')[1].trim();
            } else {
                return 'String';
            }
        } else {
            return pp.getText().split(':')[1].trim();
        }
    }

    /**
     * Gets the value of a polymer property declaration term other than type
     * @param pp polymer property declaration node
     * @param term term - e.g. observer, notify, readOnly ...
     */
    _parsePolymerDecTerm(pp: ts.Node, term: string): string {
        if (pp.getText().includes('{')) {
            const ppterm = this._walkUntil(pp, ts.SyntaxKind.PropertyAssignment, term + ':', false, true);
            if (ppterm) {
                return ppterm.getText().split(':')[1].trim().replace(/\r/g, '').replace(/\n/g, " ").replace(/ +(?= )/g, '');
            } else {
                return "";
            }
        } else {
            return "";
        }
    }

    /**
     * Gets the annotated type, if any, from a polymer property declaration
     * @param pp polymer property declaration node
     */
    _parsePolymerDecAnnotatedType(pp: ts.Node): string {
        if (pp.getFullText().includes('@type {')) {
            const rx = /@type {\s*([A-Za-z0-9_$\[\]]+)}/gm;
            const rxm = rx.exec(pp.getFullText());
            return rxm ? rxm[1] : "";
        } else {
            return "";
        }
    }

    /**
     * creates a structured object from the @polyProp value
     * @param details the value term of the polyProp comment e,g, '{ value: "", notify: true }'
     */
    _parsePolyPropDetails(details: string): IpolyProp {
        let result: IpolyProp = { value: '', notify: '', observer: '', readOnly: '', reflectToAttribute: '', computed: '' };
        if (details) {
            const tempSrc: string = 'a = ' + details + ';';
            const tempAst = ts.createSourceFile('tmp.ts', tempSrc, ts.ScriptTarget.Latest, true);
            const objlit = this._walkUntil(tempAst, ts.SyntaxKind.ObjectLiteralExpression, '');
            if (objlit) {
                ['value', 'notify', 'observer', 'readOnly', 'reflectToAttribute', 'computed'].forEach((term: string) => {
                    const pa = this._walkUntil(objlit, ts.SyntaxKind.PropertyAssignment, term + ':');
                    if (pa) {
                        result[term] = pa.getText().replace(term + ':', '').trim();
                    }
                });
            }
        }
        return result;
    }

    /**
     * Performs the document updates in the activee editor window
     * by removing old property declarations from the bottomm to the 
     * top then inserting the new properties.
     * @param editor active editor
     * @param propBuild properties to remove
     * @param newProps new property declarations as a string
     * @param insertPosition insertion position for new properties
     */
    _performDocumentUpdates(editor: vscode.TextEditor, propBuild: IpropBuild[], newProps: string, insertPosition: number): void {
        // sort by descending position to allow
        // removals from bottom up
        propBuild.sort((a, b) => {
            return b.existingTargetDeclaration.start - a.existingTargetDeclaration.start;
        });
        // convert all deletion areas to 
        // vscode line/col form required by
        // editBuilder edits
        propBuild.forEach((pb) => {
            if (!pb.isNew && pb.existingTargetDeclaration.start > 0) {
                pb.existingTargetDeclaration.editorPosition = this._getVscodeRange(editor, pb.existingTargetDeclaration.start, pb.existingTargetDeclaration.end);
            }
        });
        // convert the insertion point to 
        // line/col
        const editInsertionPos: vscode.Position = this._getVscodeRange(editor, insertPosition, insertPosition).start;
        // perform all updates
        // in a single batch
        editor.edit((editBuilder) => {
            let hasInserted: boolean = false;
            propBuild.forEach((pb) => {
                if (!pb.isNew && pb.existingTargetDeclaration.start > 0 && pb.existingTargetDeclaration.editorPosition && pb.existingTargetDeclaration.editorPosition.start.line > 0) {
                    if (!hasInserted && pb.existingTargetDeclaration.editorPosition.start.line === editInsertionPos.line && pb.existingTargetDeclaration.editorPosition.start.character === editInsertionPos.character) {
                        editBuilder.replace(pb.existingTargetDeclaration.editorPosition, newProps);
                        hasInserted = true;
                    } else {
                        editBuilder.delete(pb.existingTargetDeclaration.editorPosition);
                    }
                }
            });
            if (!hasInserted && editInsertionPos.line > 0 && editInsertionPos.line > 0) {
                editBuilder.insert(editInsertionPos, newProps);
            }
        });
    }

    /**
     * Returns the default typescript type for a given polymer type
     * @param polymerType Polymer Type
     */
    _PolymerTypeToTs(polymerType: string): string {
        let result = 'any';
        switch (polymerType) {
            case "String":
                result = "string";
                break;
            case "Boolean":
                result = "boolean";
                break;
            case "Date":
                result = "Date";
                break;
            case "Number":
                result = "number";
                break;
            case "Array":
                result = "any[]";
                break;
            case "Object":
                result = "any";
                break;
            default:
                break;
        }
        return result;
    }

    /**
     * Deletes a line from the targetComment in a jsDoc structure
     * @param sourceJsDoc a JsDoc structure
     * @param lineToRemove text of a line to remove
     */
    _removeJsDocLine(sourceJsDoc: IjsdocComment, lineToRemove: string): void {
        // line ending inconsistency in jsdoc 
        const tc: string[] = sourceJsDoc.targetComment.replace(/\r/g, '').split('\n');
        sourceJsDoc.targetComment = tc.filter((s) => {
            return !s.includes('* ' + lineToRemove);
        }).join(this.lineEnding);
    }

    /**
     * Removes part of a string by start and end position
     * @param str source string
     * @param start starting position 
     * @param end ending position
     */
    _removeStringRange(str: string, start: number, end: number): string {
        return str.slice(0, start) + str.slice(end);
    }

    /**
     * Gets the polymer property type for a typescript node
     * @param tsProp Node containing a typescript property declaration
     */
    _tsTypeToPolymerType(tsProp: ts.Node): string {
        const tst: string = tsProp.getText().split(':')[1].replace(';', '').trim();
        let result = 'Object';
        switch (tst) {
            case "string":
                result = "String";
                break;
            case "boolean":
                result = "Boolean";
                break;
            case "Date":
                result = "Date";
                break;
            case "number":
                result = "Number";
                break;
            case "any":
                result = "Object";
                break;
            default:
                if (tst.includes('[]') || tst.includes('Array<')) {
                    result = 'Array';
                }
                break;
        }
        return result;
    }

    /**
     * Walks the AST until finding the node we are looking for
     * @param node node to search in
     * @param searchNodeType type of node to search for
     * @param searchFor text the node must contain
     */
    _walkUntil(node: ts.Node, searchNodeType: ts.SyntaxKind, searchFor: string, fullTextSearch?: boolean, skipThisNode?: boolean): ts.Node | null {
        let result: ts.Node | null = null;
        if (!skipThisNode && node && node.kind === searchNodeType && (searchFor === "" ? true : fullTextSearch ? node.getFullText().includes(searchFor) : node.getText().includes(searchFor))) {
            return node;
        } else {
            const children = node.getChildren();
            if (children.length === 0) {
                return null;
            } else {
                children.forEach((childNode) => {
                    if (!result) {
                        result = this._walkUntil(childNode, searchNodeType, searchFor, fullTextSearch);
                    }
                });
                return result;
            }
        }
    }
}