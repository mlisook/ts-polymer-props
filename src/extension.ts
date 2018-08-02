'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as ts from 'typescript';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    let ptp = new PolymerTsProps();

    let disposable_updateTsProps = vscode.commands.registerCommand('extension.updateTsProps', () => { ptp.updateTsProps(); });
    let disposable_updatePolymerProps = vscode.commands.registerCommand('extension.updatePolymerProps', () => { ptp.updatePolymerProps(); });

    context.subscriptions.push(disposable_updateTsProps);
    context.subscriptions.push(disposable_updatePolymerProps);
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
}

/**
 * structure for building change list
 * in the target property declarations
 */
interface IpropBuild {
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
    isNew: boolean;
    existingTargetDeclaration: IpropPosition;
    sourceDeclaration: IpropPosition;
}

export class PolymerTsProps {

    lineEnding: string;
    lineEndingLength: number;

    constructor() {
        this.lineEnding = <string>vscode.workspace.getConfiguration("files").get("eol");
        this.lineEndingLength = this.lineEnding.length;
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
        this._removeExistingProps(editor, bld);
        this._insertNewProps(editor, newProps, insertionPoint);
        vscode.window.showInformationMessage(`${pprops.length} polymer properties added/updated as TS properties.`);
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
            const polyProps: ts.Node[] = this._getTsPolyProps(ast);
            vscode.window.showInformationMessage(`Retrieved ${polyProps.length} typescript propert declarations`);
        }
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
                isNew: true,
                existingTargetDeclaration: { start: -1, end: -1 },
                sourceDeclaration: { start: pp.pos, end: pp.end }
            };
            if (tsp) {
                ppbld.isNew = false;
                ppbld.existingTargetDeclaration = { start: tsp.pos, end: tsp.end };
            }
            if (ppbld.value || ppbld.reflectToAttribute || ppbld.readOnly || ppbld.notify || ppbld.computed || ppbld.observer) {
                ppbld.polymerDeclareStyleObject = true;
            }
            ppbld.tsType = ppbld.typeComment ? ppbld.typeComment : this._PolymerTypeToTs(ppbld.polymerType);
            result.push(ppbld);
        });
        return result;
    }


    _generateTsPropDecs(bld: IpropBuild[]): string {
        let result = this.lineEnding + this.lineEnding;
        bld.sort((a, b) => {
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
        bld.forEach((b) => {
            result += this._generatePolyPropComment(b);
            result += b.name + "!: " + b.tsType + ";" + this.lineEnding;
        });
        return result;
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
                // @ts-ignore
                if (<string>b[k]) {
                    // @ts-ignore
                    result += delim + k + ": " + b[k];
                    delim = ", ";
                }
            });
            result += " }";
        }
        return "// polyProp" + result + this.lineEnding;
    }

    /**
     * Returns the node cooresponding to the class declaration
     * @param ast Abstract Syntax Tree
     */
    _getClassNode(ast: ts.SourceFile): ts.Node | null {
        return this._walkUntil(ast, ts.SyntaxKind.ClassDeclaration, "class");
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
            const sl = this._walkUntil(cls, ts.SyntaxKind.SyntaxList, 'polyProp');
            if (sl) {
                const slChildren = sl.getChildren();
                if (slChildren && slChildren.length > 0) {
                    slChildren.forEach((c) => {
                        if (c.kind === ts.SyntaxKind.PropertyDeclaration && c.getFullText().includes('polyProp')) {
                            result.push(c);
                        }
                    });
                }
            }
        }
        return result;
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


    _getVsRange(editor: vscode.TextEditor, stringPos: number, stringEnd: number): vscode.Range {
        let p: number = 0;
        let doc = editor.document;
        let start: vscode.Position = new vscode.Position(0, 0);
        let stop: vscode.Position = new vscode.Position(0, 0);
        let startFound = false;
        let stopFound = false;
        // console.log(doc.getText().substr(stringPos, stringEnd-stringPos));

        for (let index = 0; index < doc.lineCount; index++) {
            let lineText = doc.lineAt(index).text;
            // console.log(index,  lineText.length, p, lineText);
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


    _insertNewProps(editor: vscode.TextEditor, newProps: string, insertPosition: number) {
        editor.edit((editBuilder) => {

            const pos = this._getVsRange(editor, insertPosition, insertPosition);
            if (pos.start.line > 0 && pos.end.line > 0) {
                editBuilder.insert(pos.start, newProps);
            }

        });
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
                return ppterm.getText().split(':')[1].trim().replace(/\r/g,'').replace(/\n/g, " ").replace(/ +(?= )/g,'');
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
     * Removes existing property declarations
     * @param doc document from active window
     * @param propBuild array of properties to create
     */
    _removeExistingProps(editor: vscode.TextEditor, propBuild: IpropBuild[]): void {
        propBuild.sort((a, b) => {
            return b.existingTargetDeclaration.start - a.existingTargetDeclaration.start;
        });
        editor.edit((editBuilder) => {
            propBuild.forEach((pb) => {
                if (!pb.isNew && pb.existingTargetDeclaration.start > 0) {
                    const pos = this._getVsRange(editor, pb.existingTargetDeclaration.start, pb.existingTargetDeclaration.end);
                    if (pos.start.line > 0 && pos.end.line > 0) {
                        editBuilder.delete(pos);
                    }
                }
            });
        });
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